const Usuario = require("../models/Usuario");
const Producto = require("../models/Producto");
const Cliente = require("../models/Cliente");
const Pedido = require("../models/Pedido");

const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "variables.env" });

const crearToken = (usuario, secreta, expiresIn) => {
  const { id, email, nombre, apellido } = usuario;

  return jwt.sign({ id, email, nombre, apellido }, secreta, { expiresIn });
};

const resolvers = {
  Query: {
    obtenerUsuario: async (_, { token }) => {
      const usuarioId = await jwt.verify(token, process.env.SECRETA);

      return usuarioId;
    },
    obtenerProductos: async () => {
      try {
        const productos = await Producto.find({});
        return productos;
      } catch (error) {
        console.log("ERROR =>", error);
      }
    },
    obtenerProducto: async (_, { id }) => {
      //revisar si producto existe
      const producto = await Producto.findById(id);
      if (!producto) throw new Error("Producto no encontrado");

      return producto;
    },
    obtenerClientes: async () => {
      try {
        const clientes = await Cliente.find({});
        return clientes;
      } catch (error) {
        console.log("ERROR =>", error);
      }
    },
    obtenerClientesVendedor: async (_, {}, ctx) => {
      try {
        const clientes = await Cliente.find({ vendedor: ctx.usuario.id });
        return clientes;
      } catch (error) {
        console.log("ERROR =>", error);
      }
    },
    obtenerCliente: async (_, { id }, ctx) => {
      //revisar si existe
      const cliente = await Cliente.findById(id);
      if (!cliente) throw new Error("Cliente no encontrado");

      //quien lo creo puede verlo
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      return cliente;
    },
    obtenerPedidos: async () => {
      try {
        const pedidos = await Pedido.find({});
        return pedidos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerPedidosVendedor: async (_, {}, ctx) => {
      try {
        const pedidos = await Pedido.find({ vendedor: ctx.usuario.id });
        return pedidos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerPedido: async (_, { id }, ctx) => {
      //si el pedido existe
      const pedido = await Pedido.findById(id);
      if (!pedido) throw new Error("Pedido no encontrado");

      //solo quien lo creo puede verlo
      if (pedido.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      //retornar resultado
      return pedido;
    },
    obtenerPedidosEstado: async (_, { estado }, ctx) => {
      const pedidos = await Pedido.find({
        vendedor: ctx.usuario.id,
        estado: estado,
      });

      return pedidos;
    },
    mejoresClientes: async () => {
      const clientes = await Pedido.aggregate([
        { $match: { estado: "COMPLETADO" } },
        {
          $group: {
            _id: "$cliente",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "clientes",
            localField: "_id",
            foreignField: "_id",
            as: "cliente",
          },
        },
        {
          $limit: 10,
        },
        {
          $sort: {
            total: -1,
          },
        },
      ]);

      return clientes;
    },
    mejoresVendedores: async () => {
      const vendedores = await Pedido.aggregate([
        { $match: { estado: "COMPLETADO" } },
        {
          $group: {
            _id: "$vendedor",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "usuarios",
            localField: "_id",
            foreignField: "_id",
            as: "vendedor",
          },
        },
        {
          $limit: 3,
        },
        {
          $sort: { total: -1 },
        },
      ]);

      return vendedores;
    },
    buscarProducto: async (_, { texto }) => {
      const productos = await Producto.find({
        $text: { $search: texto },
      }).limit(10);

      return productos;
    },
  },
  Mutation: {
    nuevoUsuario: async (_, { input }) => {
      const { email, password } = input;

      //revisar si user est?? registrado
      const existeUsuario = await Usuario.findOne({ email });
      if (existeUsuario) {
        throw new Error("El usuario ya est?? registrado");
      }

      //hashear password
      const salt = await bcryptjs.genSalt(10);
      input.password = await bcryptjs.hash(password, salt);

      try {
        //guardarlo en DB
        const usuario = new Usuario(input);
        usuario.save(); //guardarlo

        return usuario;
      } catch (error) {
        console.log("ERROR =>", error);
      }
    },
    autenticarUsuario: async (_, { input }) => {
      const { email, password } = input;

      //si usuario existe
      const existeUsuario = await Usuario.findOne({ email });
      if (!existeUsuario) {
        throw new Error("El usuario no existe");
      }

      //revisar password correcto
      const passwordCorrecto = await bcryptjs.compare(
        password,
        existeUsuario.password
      );
      if (!passwordCorrecto) {
        throw new Error("La contrase??a es incorrecta");
      }

      // crear token
      return {
        token: crearToken(existeUsuario, process.env.SECRETA, "24h"),
      };
    },
    nuevoProducto: async (_, { input }) => {
      try {
        const producto = new Producto(input);

        //almacenar en DB
        const resultado = await producto.save();
        return resultado;
      } catch (error) {
        console.log("ERROR =>", error);
      }
    },
    actualizarProducto: async (_, { id, input }) => {
      let producto = Producto.findById(id);
      if (!producto) throw new Error("Producto no encontrado");

      //guardar en DB
      producto = await Producto.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return producto;
    },
    eliminarProducto: async (_, { id }) => {
      //revisar si existe
      let producto = await Producto.findById(id);
      if (!producto) throw new Error("Producto no encontrado");

      //eliminar
      await Producto.findOneAndDelete({ _id: id });
      return "Producto eliminado";
    },
    nuevoCliente: async (_, { input }, ctx) => {
      console.log(ctx);
      const { email } = input;

      //verificar cliente esta registrado
      const cliente = await Cliente.findOne({ email });
      if (cliente) throw new Error("Cliente ya registrado");

      const nuevoCliente = new Cliente(input);

      //asignar vendedor
      nuevoCliente.vendedor = ctx.usuario.id;

      //guardar DB
      try {
        const resultado = await nuevoCliente.save();

        return resultado;
      } catch (error) {
        console.log("ERROR =>", error);
      }
    },
    actualizarCliente: async (_, { id, input }, ctx) => {
      //verificar si existe
      let cliente = await Cliente.findById(id);
      if (!cliente) throw new Error("Ese cliente no existe");

      //verificar si el vendedor es quien edita
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      //guardarcliente
      cliente = await Cliente.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return cliente;
    },
    eliminarCliente: async (_, { id }, ctx) => {
      //verificar si existe
      let cliente = await Cliente.findById(id);
      if (!cliente) throw new Error("Ese cliente no existe");

      //verificar si el vendedor es quien edita
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      //eliminar cliente
      await Cliente.findOneAndDelete({ _id: id });
      return "Cliente eliminado";
    },
    nuevoPedido: async (_, { input }, ctx) => {
      const { cliente } = input;

      //verificar si cliente existe
      let clienteExiste = await Cliente.findById(cliente);
      if (!clienteExiste) throw new Error("El cliente no existe");

      //verificar si cliente es del vendedor
      if (clienteExiste.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      //revisar hay stock
      for await (const articulo of input.pedido) {
        const { id } = articulo;

        const producto = await Producto.findById(id);

        if (articulo.cantidad > producto.existencia) {
          throw new Error(
            `El art??culo: ${producto.nombre} excede la cantidad disponible en ${
              articulo.cantidad - producto.existencia
            } unidades`
          );
        } else {
          //restar cantidad al stock disponible
          producto.existencia = producto.existencia - articulo.cantidad;
          await producto.save();
        }
      }

      //crear nuevo pedido
      const nuevoPedido = new Pedido(input);

      //asignar vendedor
      nuevoPedido.vendedor = ctx.usuario.id;

      //guardar DB
      const resultado = await nuevoPedido.save();
      return resultado;
    },
    actualizarPedido: async (_, { id, input }, ctx) => {
      const { cliente } = input;

      //verificar si pedido existe
      const existePedido = await Pedido.findById(id);
      if (!existePedido) throw new Error("El pedido no existe");

      //cliente existe
      const existeCliente = await Cliente.findById(cliente);
      if (!existeCliente) throw new Error("El cliente no existe");

      //si cliente y pedido pertenece vendedor
      if (existeCliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      //revisar hay stock
      if (input.pedido) {
        for await (const articulo of input.pedido) {
          const { id } = articulo;

          const producto = await Producto.findById(id);

          if (articulo.cantidad > producto.existencia) {
            throw new Error(
              `El art??culo: ${
                producto.nombre
              } excede la cantidad disponible en ${
                articulo.cantidad - producto.existencia
              } unidades`
            );
          } else {
            //restar cantidad al stock disponible
            producto.existencia = producto.existencia - articulo.cantidad;
            await producto.save();
          }
        }
      }

      //guardar pedido
      const resultado = await Pedido.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return resultado;
    },
    eliminarPedido: async (_, { id }, ctx) => {
      //verificar pedido
      const pedido = await Pedido.findById(id);
      if (!pedido) throw new Error("El pedido no existe");

      //verificar usuario
      if (pedido.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      //eliminar DB
      await Pedido.findOneAndDelete({ _id: id });
      return "Pedido eliminado";
    },
  },
};

module.exports = resolvers;
